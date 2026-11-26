"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useId, useState } from "react";
import { changeLanguage } from "@/lib/collab";
import { needsJudge0, runtimeNote } from "@/lib/languages";
import { MAX_STDIN_CHARS } from "@/lib/run-contract";
import type { ParticipantIdentity } from "@/lib/participants";
import { useCollaboration } from "@/hooks/use-collaboration";
import { useRunAvailability, useRunCode } from "@/hooks/use-run-code";
import { useRoomStore } from "@/store/room";
import { ConnectionBanner, ConnectionStatus } from "./ConnectionStatus";
import { CopyLinkButton } from "./CopyLinkButton";
import { ExportButton, RoomLifetimeNotice } from "./ExportButton";
import { ROOM_EMPTY_TTL_MINUTES } from "@/lib/config";
import { EditorSkeleton } from "./EditorSkeleton";
import { LanguageSelect } from "./LanguageSelect";
import { Logo } from "./Logo";
import { OutputPanel } from "./OutputPanel";
import { FollowBanner, ParticipantList, RemoteCursorStyles } from "./ParticipantList";

// Monaco (~several MB) is split out of the main bundle and never rendered on the server.
const CodeEditor = dynamic(() => import("./CodeEditor"), { ssr: false, loading: () => <EditorSkeleton /> });

export function Workspace({ roomId, identity }: { roomId: string; identity: ParticipantIdentity }) {
  const collab = useCollaboration(roomId, identity, true);
  const language = useRoomStore((s) => s.language);
  const isRunning = useRoomStore((s) => s.isRunning);
  const lastRun = useRoomStore((s) => s.lastRun);
  const runPhase = useRoomStore((s) => s.runPhase);
  const configured = useRunAvailability();
  const [stdin, setStdin] = useState("");
  const run = useRunCode(identity.name, stdin);
  const stdinId = useId();
  const noteId = useId();
  const runBlocked = needsJudge0(language) && configured === false;

  return (
    <div className="flex h-dvh flex-col">
      <RemoteCursorStyles />
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-panel px-4 py-2">
        <Logo compact />
        <div className="flex items-center gap-2 font-mono text-xs text-muted">
          <span className="hidden sm:inline">room</span>
          <span className="text-fg" data-testid="room-id">
            {roomId}
          </span>
        </div>
        <CopyLinkButton roomId={roomId} />
        <ExportButton roomId={roomId} />
        <div className="ml-auto flex items-center gap-3">
          <ConnectionStatus />
          <ParticipantList />
          <Link
            href="/"
            onClick={() => useRoomStore.getState().leave()}
            className="rounded text-xs text-muted transition hover:text-fg"
          >
            Leave
          </Link>
        </div>
      </header>
      <ConnectionBanner />
      <RoomLifetimeNotice ttlMinutes={ROOM_EMPTY_TTL_MINUTES} />
      <FollowBanner />

      <main id="main" className="grid min-h-0 flex-1 grid-rows-[minmax(320px,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-1">
        <section aria-labelledby="editor-heading" className="flex min-h-0 flex-col border-line lg:border-r">
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-panel px-4 py-2">
            <h2 id="editor-heading" className="sr-only">
              Editor
            </h2>
            <LanguageSelect value={language} onChange={(next) => collab && changeLanguage(collab.doc, next)} disabled={!collab} judge0Configured={configured} />
            <button
              type="button"
              onClick={() => void run()}
              disabled={!collab || isRunning || runBlocked}
              aria-describedby={noteId}
              aria-keyshortcuts="Control+Enter Meta+Enter"
              className="inline-flex h-8 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60"
            >
              <span aria-hidden="true">▶</span>
              {isRunning ? "Running…" : "Run"}
            </button>
            <p id={noteId} data-testid="runtime-note" className="min-w-0 basis-full text-xs text-muted sm:basis-auto sm:flex-1">
              {runtimeNote(language, configured)}
            </p>
            <p className="ml-auto hidden text-xs text-muted 2xl:block">
              <kbd className="font-mono">Ctrl+M</kbd> lets Tab leave the editor
            </p>
          </div>
          <div className="min-h-0 flex-1" data-testid="editor-host">
            <CodeEditor onRun={() => void run()} />
          </div>
        </section>

        <aside aria-labelledby="output-heading" className="flex min-h-0 flex-col gap-4 overflow-auto border-t border-line bg-panel p-4 lg:border-t-0">
          <details className="group rounded-md border border-line bg-panel-2">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium select-none">
              Program input (stdin){stdin ? " · set" : ""}
            </summary>
            <div className="px-3 pb-3">
              <label htmlFor={stdinId} className="sr-only">
                Program input
              </label>
              <textarea
                id={stdinId}
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                maxLength={MAX_STDIN_CHARS}
                rows={4}
                spellCheck={false}
                placeholder="Text your program reads from standard input"
                className="w-full rounded-md border border-line-strong bg-ink p-2 font-mono text-[13px] text-fg placeholder:text-muted"
              />
            </div>
          </details>
          <h2 id="output-heading" className="text-sm font-semibold">
            Output
          </h2>
          <OutputPanel run={lastRun} isRunning={isRunning} configured={configured} selfName={identity.name} language={language} phase={runPhase} />
        </aside>
      </main>
    </div>
  );
}
