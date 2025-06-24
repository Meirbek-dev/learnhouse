import * as Form from '@radix-ui/react-form';
import type { ReactNode } from 'react';
import type * as React from 'react';
import { Info } from 'lucide-react';
import { Input as ShadcnInput } from '@/components/ui/input';
import { Textarea as ShadcnTextarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormLayoutProps {
  children: ReactNode;
  onSubmit: (e: any) => void;
  className?: string;
}

const FormLayout = ({ children, onSubmit, className }: FormLayoutProps) => (
  <Form.Root
    onSubmit={onSubmit}
    className={cn('space-y-4', className)}
  >
    {children}
  </Form.Root>
);

export const FormLabelAndMessage = (props: { label: string; message?: string }) => (
  <div className="flex items-center space-x-3">
    <Label className="grow text-sm font-medium">{props.label}</Label>
    {props.message && (
      <div className="flex w-auto items-center space-x-1 rounded-md text-sm text-red-700">
        <Info size={10} />
        <div>{props.message}</div>
      </div>
    )}
  </div>
);

export const FormField = ({ className, ...props }: React.ComponentProps<typeof Form.Field>) => (
  <Form.Field
    className={cn('grid gap-1', className)}
    {...props}
  />
);

export const FormLabel = ({ className, ...props }: React.ComponentProps<typeof Form.Label>) => (
  <Form.Label
    className={cn(
      'text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className,
    )}
    {...props}
  />
);

export const FormMessage = ({ className, ...props }: React.ComponentProps<typeof Form.Message>) => (
  <Form.Message
    className={cn('text-destructive text-sm font-medium', className)}
    {...props}
  />
);

export const Flex = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    className={cn('flex', className)}
    {...props}
  />
);

export const Input = ShadcnInput;
export const Textarea = ShadcnTextarea;

export const ButtonBlack = ({ className, children, ...props }: React.ComponentProps<typeof Button>) => (
  <Button
    className={cn(
      'bg-black text-white transition-colors hover:bg-black/90 disabled:pointer-events-none disabled:opacity-50',
      className,
    )}
    {...props}
  >
    {children}
  </Button>
);

export default FormLayout;
