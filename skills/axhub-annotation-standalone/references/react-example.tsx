import React from 'react';
import {
  AnnotationViewer,
  useProtoDevState,
  type AnnotationDirectoryRouteNode,
  type AnnotationSourceDocument,
  type AnnotationViewerOptions,
} from '@axhub/annotation';
import annotationSource from './annotation-source.json';

type PageId = 'overview' | 'states';
type ResultState = 'success' | 'failure';

function normalizePageId(value: unknown): PageId {
  return value === 'states' ? 'states' : 'overview';
}

function normalizeResultState(value: unknown): ResultState {
  return value === 'failure' ? 'failure' : 'success';
}

function StateCard() {
  const protoState = useProtoDevState<{ result_state?: ResultState }>();
  const resultState = normalizeResultState(protoState.result_state);
  const isSuccess = resultState === 'success';

  return (
    <article data-annotation-id="state-card">
      <strong>{isSuccess ? '成功' : '失败'}</strong>
      <h2>{isSuccess ? '发布完成' : '发布失败'}</h2>
      <p>{isSuccess ? '可以继续评审标注内容。' : '需要展示失败原因和重试入口。'}</p>
    </article>
  );
}

export function AnnotationStandaloneReactExample() {
  const [pageId, setPageId] = React.useState<PageId>('overview');
  const [modalOpen, setModalOpen] = React.useState(false);

  const options = React.useMemo<AnnotationViewerOptions>(() => ({
    currentPageId: pageId,
    showToolbar: true,
    showThemeToggle: true,
    showColorFilter: true,
    onDirectoryRoute: (node: AnnotationDirectoryRouteNode) => {
      setPageId(normalizePageId(node.route));
    },
  }), [pageId]);

  return (
    <main>
      <nav>
        <button type="button" onClick={() => setPageId('overview')}>运行时总览</button>
        <button type="button" onClick={() => setPageId('states')}>状态标注</button>
      </nav>

      {pageId === 'overview' ? (
        <>
          <section data-annotation-id="overview-hero">
            <h1>@axhub/annotation</h1>
            <p>这是一个脱离平台的 React 接入示例。</p>
          </section>
          <button
            type="button"
            data-annotation-id="modal-background-target"
            onClick={() => setModalOpen(true)}
          >
            新建发布任务
          </button>
        </>
      ) : (
        <StateCard />
      )}

      <div
        className="example-modal-layer"
        data-open={modalOpen ? 'true' : 'false'}
        hidden={!modalOpen}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          display: modalOpen ? 'grid' : 'none',
          placeItems: 'center',
          background: 'rgba(17, 24, 39, 0.5)',
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          data-annotation-id="modal-content-target"
          style={{
            width: 'min(420px, calc(100% - 32px))',
            padding: 24,
            borderRadius: 8,
            background: '#ffffff',
          }}
        >
          <h2>新建发布任务</h2>
          <button type="button" onClick={() => setModalOpen(false)}>关闭</button>
        </section>
      </div>

      <AnnotationViewer
        source={annotationSource as AnnotationSourceDocument}
        options={options}
      />
    </main>
  );
}
