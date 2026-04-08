import * as v from 'valibot';

export type UIFieldError = { message?: string };

function toPathKey(path: unknown): string | undefined {
  if (!Array.isArray(path) || path.length === 0) {
    return undefined;
  }

  return path
    .map((segment) => {
      if (!segment || typeof segment !== 'object' || !('key' in segment)) {
        return undefined;
      }

      const key = (segment as { key: string | number }).key;
      if (typeof key === 'number') {
        return `[${key}]`;
      }

      return key;
    })
    .filter((segment): segment is string => Boolean(segment))
    .reduce((result, segment) => {
      if (segment.startsWith('[')) {
        return `${result}${segment}`;
      }

      return result ? `${result}.${segment}` : segment;
    }, '');
}

export function valibotFormValidator<TValue>(schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>) {
  return ({ value }: { value: TValue }) => {
    const result = v.safeParse(schema, value);

    if (result.success) {
      return undefined;
    }

    const fields: Record<string, string> = {};
    let formError: string | undefined;

    for (const issue of result.issues ?? []) {
      const pathKey = toPathKey(issue.path);

      if (pathKey) {
        fields[pathKey] ??= issue.message;
      } else {
        formError ??= issue.message;
      }
    }

    if (!formError && Object.keys(fields).length === 0) {
      return undefined;
    }

    return {
      form: formError,
      fields,
    };
  };
}

export function toFieldErrors(errors: readonly unknown[] | undefined): UIFieldError[] | undefined {
  if (!errors?.length) {
    return undefined;
  }

  return errors.map((error) => {
    if (typeof error === 'string') {
      return { message: error };
    }

    if (error && typeof error === 'object' && 'message' in error) {
      return error as UIFieldError;
    }

    return { message: String(error) };
  });
}
