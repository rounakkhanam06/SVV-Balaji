import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type CreateTransporterDto, transportersApi } from '../../../shared/api/transporters';

const CACHE_KEY = ['transporters'];

export function useTransporters(params?: { q?: string; active?: 'true' | 'false' }, enabled = true) {
  return useQuery({
    queryKey: [...CACHE_KEY, params ?? {}],
    queryFn: () => transportersApi.list(params),
    enabled,
  });
}

export function useCreateTransporter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTransporterDto) => transportersApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CACHE_KEY }),
  });
}

export function useUpdateTransporter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTransporterDto> }) => transportersApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CACHE_KEY }),
  });
}

export function useSetTransporterActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => transportersApi.setActive(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: CACHE_KEY }),
  });
}
