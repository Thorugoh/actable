import type { DispatchMeta, Runtime } from '@actable/core';
import { errorResponse, resultResponse, type RpcRequest, type RpcResponse } from '../protocol/json-rpc';
import { RpcErrorCodes } from '../protocol/bridge-protocol';

type InvokeParams = { name?: string; input?: unknown; meta?: Partial<DispatchMeta> };

/** Serves one request from the relay against the running app. */
export async function handleRequest(
  runtime: Runtime,
  request: RpcRequest,
  screenshot?: () => Promise<string>,
): Promise<RpcResponse> {
  try {
    switch (request.method) {
      case 'actions.list':
        return resultResponse(request.id, runtime.describeActions());
      case 'actions.invoke':
        return await invoke(runtime, request);
      case 'app.inspect':
        return resultResponse(request.id, runtime.inspect());
      case 'dev.screenshot':
        if (!screenshot) return errorResponse(request.id, RpcErrorCodes.MethodNotFound, 'This app cannot take screenshots');
        return resultResponse(request.id, { base64: await screenshot(), format: 'png' });
      default:
        return errorResponse(request.id, RpcErrorCodes.MethodNotFound, `Unknown method "${request.method}"`);
    }
  } catch (error) {
    return errorResponse(request.id, RpcErrorCodes.Internal, error instanceof Error ? error.message : String(error));
  }
}

async function invoke(runtime: Runtime, request: RpcRequest): Promise<RpcResponse> {
  const params = request.params as InvokeParams | undefined;
  if (!params?.name || !params.meta?.origin) {
    return errorResponse(request.id, RpcErrorCodes.InvalidParams, 'actions.invoke needs { name, input, meta: { origin } }');
  }
  return resultResponse(request.id, await runtime.dispatch(params.name, params.input, params.meta as DispatchMeta));
}
