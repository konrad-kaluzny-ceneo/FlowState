import { TRPCClientError } from "@trpc/client";

export function isTrpcErrorCode(error: unknown, code: string): boolean {
	if (!(error instanceof TRPCClientError)) {
		return false;
	}
	return error.data?.code === code || error.shape?.code === code;
}
