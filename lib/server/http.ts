import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fieldErrors } from "../validation.ts";
import { ApiError } from "./appointments.ts";

const noStore = { "cache-control": "no-store" };

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: noStore });
}

/** Runs a handler and turns thrown errors into friendly JSON responses. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof z.ZodError) {
      const fields = fieldErrors(err);
      return json({ error: Object.values(fields)[0] ?? "Please check the form.", fields }, 400);
    }
    if (err instanceof ApiError) return json({ error: err.message, fields: err.fields }, err.status);
    console.error(err);
    return json({ error: "Something went wrong on our side. Please try again in a moment." }, 500);
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "The request body wasn't valid JSON.");
  }
}
