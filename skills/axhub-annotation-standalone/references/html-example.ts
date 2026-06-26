import annotationSource from './annotation-source.json';

type PageId = 'overview' | 'states';
type AnnotationDirectoryRouteNode = { route?: string };
type AnnotationSourceDocument = typeof annotationSource;
type ProtoDevState = Record<string, unknown>;
type ProtoDevRuntime = {
  getState(): ProtoDevState;
  subscribe(listener: () => void): () => void;
};
type AnnotationViewerApi = {
  start(): Promise<void>;
  refresh(): void;
};

declare global {
  interface Window {
    AxhubAnnotation?: {
      createAnnotationViewer(config: {
        source: AnnotationSourceDocument;
        options?: {
          getCurrentPageId?: () => string;
          showToolbar?: boolean;
          showThemeToggle?: boolean;
          showColorFilter?: boolean;
          onDirectoryRoute?: (node: AnnotationDirectoryRouteNode) => void;
        };
      }): AnnotationViewerApi;
    };
    __AXHUB_PROTO_DEV__?: ProtoDevRuntime;
  }
}

let currentPageId: PageId = 'overview';

function normalizePageId(value: unknown): PageId {
  return value === 'states' ? 'states' : 'overview';
}

function renderPage(pageId: PageId): void {
  currentPageId = pageId;
  document.querySelectorAll<HTMLElement>('[data-page]').forEach((page) => {
    page.hidden = page.dataset.page !== pageId;
  });
}

function renderState(state: ProtoDevState): void {
  const isFailure = state.result_state === 'failure';
  const label = document.querySelector('[data-result-label]');
  const title = document.querySelector('[data-result-title]');

  if (label) label.textContent = isFailure ? '失败' : '成功';
  if (title) title.textContent = isFailure ? '发布失败' : '发布完成';
}

const axhubAnnotation = window.AxhubAnnotation;

if (!axhubAnnotation) {
  throw new Error('Missing window.AxhubAnnotation browser bundle.');
}

const viewer = axhubAnnotation.createAnnotationViewer({
  source: annotationSource as AnnotationSourceDocument,
  options: {
    getCurrentPageId: () => currentPageId,
    showToolbar: true,
    showThemeToggle: true,
    showColorFilter: true,
    onDirectoryRoute: (node: AnnotationDirectoryRouteNode) => {
      renderPage(normalizePageId(node.route));
      viewer.refresh();
    },
  },
});

document.querySelectorAll<HTMLButtonElement>('[data-route]').forEach((button) => {
  button.addEventListener('click', () => {
    renderPage(normalizePageId(button.dataset.route));
    viewer.refresh();
  });
});

void viewer.start().then(() => {
  const attach = () => {
    const protoDev = window.__AXHUB_PROTO_DEV__;
    if (!protoDev) {
      window.setTimeout(attach, 80);
      return;
    }

    renderState(protoDev.getState());
    protoDev.subscribe(() => renderState(protoDev.getState()));
  };

  attach();
});

renderPage(currentPageId);
