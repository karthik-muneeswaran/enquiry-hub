import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request, Response } from 'express';

/**
 * Extracts the Express Request object from any NestJS execution context.
 * Works for both HTTP (REST) and GraphQL contexts.
 *
 * In GraphQL, Apollo passes the underlying HTTP request via context.
 */
export function getRequestFromContext(context: ExecutionContext): Request | null {
  if (context.getType<string>() === 'graphql') {
    const gqlCtx = GqlExecutionContext.create(context);
    return gqlCtx.getContext().req ?? null;
  }
  return context.switchToHttp().getRequest<Request>() ?? null;
}

/**
 * Extracts the Express Response object from any NestJS execution context.
 * Works for both HTTP (REST) and GraphQL contexts.
 */
export function getResponseFromContext(context: ExecutionContext): Response | null {
  if (context.getType<string>() === 'graphql') {
    const gqlCtx = GqlExecutionContext.create(context);
    return gqlCtx.getContext().res ?? null;
  }
  return context.switchToHttp().getResponse<Response>() ?? null;
}

/**
 * Checks if the current context is a GraphQL execution.
 */
export function isGraphQLContext(context: ExecutionContext): boolean {
  return context.getType<string>() === 'graphql';
}
