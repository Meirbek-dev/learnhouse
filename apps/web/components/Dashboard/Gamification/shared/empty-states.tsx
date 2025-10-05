import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface EmptyStateProps {
  title?: string;
  message: string;
}

export function EmptyProfile({ title, message }: EmptyStateProps) {
  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <p className="text-muted-foreground py-4 text-center">{message}</p>
      </CardContent>
    </Card>
  );
}

export function EmptyStats({ title, message }: EmptyStateProps) {
  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <p className="text-muted-foreground py-4 text-center">{message}</p>
      </CardContent>
    </Card>
  );
}

export function EmptyLeaderboard({ title, message }: EmptyStateProps) {
  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <p className="text-muted-foreground py-4 text-center">{message}</p>
      </CardContent>
    </Card>
  );
}

export function EmptyActivity({ title, message }: EmptyStateProps) {
  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <p className="text-muted-foreground py-4 text-center">{message}</p>
      </CardContent>
    </Card>
  );
}
