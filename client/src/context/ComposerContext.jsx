import { createContext, lazy, Suspense, useCallback, useContext, useMemo, useState } from 'react';

const PostComposer = lazy(() => import('../components/posts/PostComposer.jsx'));
const StoryComposer = lazy(() => import('../components/stories/StoryComposer.jsx'));

const ComposerContext = createContext(null);

/** App-wide entry points for creating/editing posts and adding stories. */
export function ComposerProvider({ children }) {
  const [state, setState] = useState(null); // { kind: 'post' | 'story', post? }

  const openPost = useCallback((post = null) => setState({ kind: 'post', post }), []);
  const openStory = useCallback(() => setState({ kind: 'story' }), []);
  const close = useCallback(() => setState(null), []);
  const value = useMemo(() => ({ openPost, openStory }), [openPost, openStory]);

  return (
    <ComposerContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        {state?.kind === 'post' && <PostComposer post={state.post} onClose={close} />}
        {state?.kind === 'story' && <StoryComposer onClose={close} />}
      </Suspense>
    </ComposerContext.Provider>
  );
}

export function useComposer() {
  const ctx = useContext(ComposerContext);
  if (!ctx) throw new Error('useComposer must be used inside ComposerProvider');
  return ctx;
}
