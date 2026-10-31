import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Import, ImportRow, ImportRowFilter, UpdateImportRow, UploadImportResult } from '@et/api-client';
import { api, toApiError } from '../../lib';
import { transactionKeys } from '../transactions';
import type { PickedFile } from './pick-file';

/** While the parse job runs, the import is polled this often. */
const PARSING_POLL_MS = 2_000;

export const importKeys = {
  all: ['imports'] as const,
  detail: (id: string) => ['import', id] as const,
  rows: (id: string, filter: ImportRowFilter) => ['import', id, 'rows', filter] as const,
};

export function useImports() {
  return useQuery({
    queryKey: importKeys.all,
    queryFn: async (): Promise<Import[]> => {
      const { data, error } = await api.GET('/v1/imports');
      if (!data) throw toApiError(error);
      return data.items;
    },
  });
}

/** One import; refetched every 2 s until the background parse finishes. */
export function useImport(id: string) {
  return useQuery({
    queryKey: importKeys.detail(id),
    queryFn: async (): Promise<Import> => {
      const { data, error } = await api.GET('/v1/imports/{id}', { params: { path: { id } } });
      if (!data) throw toApiError(error);
      return data;
    },
    refetchInterval: (query) => (query.state.data?.status === 'parsing' ? PARSING_POLL_MS : false),
  });
}

export function useImportRows(id: string, filter: ImportRowFilter, enabled = true) {
  return useQuery({
    queryKey: importKeys.rows(id, filter),
    enabled,
    queryFn: async (): Promise<ImportRow[]> => {
      const { data, error } = await api.GET('/v1/imports/{id}/rows', { params: { path: { id }, query: { filter } } });
      if (!data) throw toApiError(error);
      return data.items;
    },
  });
}

/** Sends the picked file as multipart; the API answers 202 and parses it in the background. */
export function useUploadImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: PickedFile): Promise<UploadImportResult> => {
      const form = new FormData();
      // React Native's FormData takes a { uri, name, type } descriptor for a file on the device.
      form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
      const { data, error } = await api.POST('/v1/imports', {
        body: form as never,
        bodySerializer: (body: unknown) => body as FormData,
      });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: async (result) => {
      queryClient.setQueryData(importKeys.detail(result.import.id), result.import);
      await queryClient.invalidateQueries({ queryKey: importKeys.all });
    },
  });
}

/** Changes one row (tick, category, fields); the import's counts change with it. */
export function useUpdateImportRow(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ rowNo, body }: { rowNo: number; body: UpdateImportRow }): Promise<ImportRow> => {
      const { data, error } = await api.PATCH('/v1/imports/{id}/rows/{rowNo}', { params: { path: { id, rowNo } }, body });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: async (row) => {
      queryClient.setQueriesData<ImportRow[]>({ queryKey: ['import', id, 'rows'] }, (rows) =>
        rows?.map((r) => (r.rowNo === row.rowNo ? row : r)),
      );
      await queryClient.invalidateQueries({ queryKey: importKeys.detail(id), exact: true });
    },
  });
}

/** Picks the account; the API re-runs the duplicate check, so every row may change. */
export function useSetImportAccount(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string): Promise<Import> => {
      const { data, error } = await api.PATCH('/v1/imports/{id}', { params: { path: { id } }, body: { accountId } });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: async (imp) => {
      queryClient.setQueryData(importKeys.detail(id), imp);
      await queryClient.invalidateQueries({ queryKey: ['import', id, 'rows'] });
    },
  });
}

/** Adds the ticked rows; the ledger, Home and Recent all change. */
export function useConfirmImport(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<Import> => {
      const { data, error } = await api.POST('/v1/imports/{id}/confirm', { params: { path: { id } } });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: async (imp) => {
      queryClient.setQueryData(importKeys.detail(id), imp);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: importKeys.all }),
        queryClient.invalidateQueries({ queryKey: transactionKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });
}

export function useDiscardImport(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error, response } = await api.DELETE('/v1/imports/{id}', { params: { path: { id } } });
      if (!response.ok) throw toApiError(error);
    },
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: importKeys.detail(id) });
      await queryClient.invalidateQueries({ queryKey: importKeys.all });
    },
  });
}
