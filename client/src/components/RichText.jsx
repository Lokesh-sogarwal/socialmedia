import { Fragment } from 'react';
import { Link } from 'react-router';

const TOKEN = /([#@][\p{L}\p{N}_.]+)/gu;

/**
 * Renders user text with #hashtags and @mentions as links. Text is rendered as
 * React children (never as HTML), so user content can't inject markup.
 */
export function RichText({ text, className }) {
  if (!text) return null;
  const parts = text.split(TOKEN);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (/^#[\p{L}\p{N}_]+$/u.test(part)) {
          return (
            <Link key={i} to={`/explore/tags/${encodeURIComponent(part.slice(1).toLowerCase())}`} className="font-medium text-charcoal underline decoration-rose decoration-2 underline-offset-2 hover:decoration-rose-deep">
              {part}
            </Link>
          );
        }
        const mention = part.match(/^@([a-zA-Z0-9_.]{3,30}?)(\.*)$/);
        if (mention) {
          return (
            <Fragment key={i}>
              <Link to={`/u/${mention[1].toLowerCase()}`} className="font-semibold hover:underline">
                @{mention[1]}
              </Link>
              {mention[2]}
            </Fragment>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </span>
  );
}
