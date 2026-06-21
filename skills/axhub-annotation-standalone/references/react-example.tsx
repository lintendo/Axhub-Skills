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
        <section data-annotation-id="overview-hero">
          <h1>@axhub/annotation</h1>
          <p>这是一个脱离平台的 React 接入示例。</p>
        </section>
      ) : (
        <StateCard />
      )}

      <AnnotationViewer
        source={annotationSource as AnnotationSourceDocument}
        options={options}
      />
    </main>
  );
}
