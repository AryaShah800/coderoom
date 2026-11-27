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
  const { run, cancel } = useRunCode(identity.name, stdin);
  const stdinId = useId();
  const noteId = useId();
  const runBlocked = needsJudge0(language) && configured === false;

  return (
    <div className="flex h-dvh flex-col">
      <RemoteCursorStyles />
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-panel px-3 py-2 sm:gap-x-4 sm:px-4">
        <Logo compact />
        <div className="flex items-center gap-2 font-mono text-xs text-muted">
          <span className="hidden sm:inline">room</span>
          <span className="text-fg" data-testid="room-id">
            {roomId}
          </span>
        </div>
        <CopyLinkButton roomId={roomId} />
        <ExportButton roomId={roomId} />
        <div className="flex min-w-0 basis-full flex-wrap items-center gap-2 sm:ml-auto sm:basis-auto sm:gap-3">
          <ConnectionStatus />
          <ParticipantList />
          <Link
            href="/"
            onClick={() => useRoomStore.getState().leave()}
            className="inline-flex min-h-10 items-center rounded px-2 text-xs text-muted transition hover:text-fg"
          >
            Leave
          </Link>
        </div>
      </header>
      <ConnectionBanner />
      <RoomLifetimeNotice roomId={roomId} ttlMinutes={ROOM_EMPTY_TTL_MINUTES} />
      <FollowBanner />

      <main id="main" className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(min-content,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-1">
        <section aria-labelledby="editor-heading" className="flex min-h-[320px] min-w-0 flex-col border-line lg:min-h-0 lg:border-r">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-panel px-3 py-2 sm:gap-3 sm:px-4">
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
              className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60"
            >
              <span aria-hidden="true">▶</span>
              {isRunning ? "Running…" : "Run"}
            </button>
            {isRunning && (
              <button
                type="button"
                onClick={cancel}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-panel-2 px-3 text-sm font-medium transition hover:border-bad hover:text-bad"
              >
                <span aria-hidden="true">■</span>
                Stop
              </button>
            )}
            <p id={noteId} data-testid="runtime-note" className="min-w-0 basis-full text-xs text-muted sm:basis-auto sm:flex-1">
              {runtimeNote(language, configured)}
            </p>
            <p className="ml-auto hidden text-xs text-muted 2xl:block">
              <kbd className="font-mono">Ctrl+M</kbd> lets Tab leave the editor
            </p>
          </div>
          <div className="min-h-[200px] min-w-0 flex-1 lg:min-h-0" data-testid="editor-host">
            <CodeEditor onRun={() => void run()} />
          </div>
        </section>

        <aside aria-labelledby="output-heading" className="flex max-h-[42dvh] min-h-0 min-w-0 flex-col gap-4 overflow-auto border-t border-line bg-panel p-4 lg:max-h-none lg:border-t-0">
          <details className="group rounded-md border border-line bg-panel-2">
            <summary className="min-h-10 cursor-pointer px-3 py-2 text-sm font-medium select-none">
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
