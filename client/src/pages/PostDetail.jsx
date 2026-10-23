import { useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { PostHeader } from '../components/posts/PostCard.jsx';
import { PostActions } from '../components/posts/PostActions.jsx';
import { MediaCarousel } from '../components/posts/MediaCarousel.jsx';
import { CommentSection } from '../components/posts/CommentSection.jsx';
import { RichText } from '../components/RichText.jsx';
import { PostSkeleton } from '../components/ui/SkeletonLoader.jsx';
import { ErrorState } from '../components/ui/States.jsx';
import { fullDate } from '../lib/format.js';
import NotFound from './NotFound.jsx';

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const formRef = useRef(null);
  const query = useQuery({ queryKey: ['post', id], queryFn: () => api.get(`/posts/${id}`) });

  if (query.isPending) return <PostSkeleton />;
  if (query.isError) {
    return query.error.status === 404 || query.error.status === 400 ? (
      <NotFound title="Post not available" description="It may have been deleted, or the account is private." />
    ) : (
      <ErrorState error={query.error} onRetry={query.refetch} />
    );
  }
  const post = query.data;
  const hasMedia = post.media.length > 0;

  return (
    <div>
      <PageHeader back title="Post" />
      <article className="card overflow-hidden lg:flex lg:max-h-[min(86dvh,52rem)]">
        {hasMedia && (
          <div className="flex items-center bg-charcoal/95 lg:w-[58%]">
            <div className="w-full">
              <MediaCarousel media={post.media} />
            </div>
          </div>
        )}
        <div className={hasMedia ? 'flex flex-col lg:w-[42%] lg:border-l lg:border-line' : 'flex w-full flex-col'}>
          <div className="border-b border-line">
            <PostHeader post={post} onDeleted={() => navigate('/')} />
          </div>
          {post.caption && (
            <div className="border-b border-line px-5 py-4">
              <p className="whitespace-pre-line break-words">
                <Link to={`/u/${post.author.username}`} className="mr-1.5 font-semibold">
                  {post.author.username}
                </Link>
                <RichText text={post.caption} />
              </p>
            </div>
          )}
          <div className="flex min-h-[18rem] flex-1 flex-col lg:min-h-0">
            <CommentSection post={post} formRef={formRef} />
          </div>
          <div className="border-t border-line pb-3">
            <PostActions post={post} onComment={() => formRef.current?.focus()} />
            <p className="px-5 pt-1 text-xs text-muted">{fullDate(post.createdAt)}</p>
          </div>
        </div>
      </article>
    </div>
  );
}
