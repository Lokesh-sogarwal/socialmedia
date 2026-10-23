import { Link } from 'react-router';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui/States.jsx';
import { Button } from '../components/ui/Button.jsx';

export default function NotFound({ title = 'Page not found', description = 'The page you’re looking for doesn’t exist or has moved.' }) {
  return (
    <div className="card">
      <EmptyState
        icon={Compass}
        title={title}
        description={description}
        action={
          <Link to="/">
            <Button>Back to home</Button>
          </Link>
        }
      />
    </div>
  );
}
