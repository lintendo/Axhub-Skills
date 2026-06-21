import {
  createAnnotationViewer,
  type AnnotationDirectoryRouteNode,
  type AnnotationSourceDocument,
  type ProtoDevState,
} from '@axhub/annotation';
import annotationSource from './annotation-source.json';

type PageId = 'overview' | 'states';

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

const viewer = createAnnotationViewer({
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
