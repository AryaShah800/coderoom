import { HomeActions } from "@/components/HomeActions";
import { Logo } from "@/components/Logo";

const FEATURES = [
  {
    title: "Edit together, live",
    body: "Yjs CRDTs merge every keystroke, so two people can type in the same line without overwriting each other.",
  },
  {
    title: "See who is where",
    body: "Each person gets a name and a colour. Their cursor and selection show up in your editor as they move.",
  },
  {
    title: "Pick a language, run it",
    body: "Eight languages with syntax highlighting. Run sends the code to a Judge0 sandbox through a server-side route.",
  },
  {
    title: "Keeps working offline",
    body: "Lose the connection and keep typing. Your edits merge back in when the sync server is reachable again.",
  },
];

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col">
      <div aria-hidden="true" className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[520px]" />
      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <Logo />
        <a
          href="https://github.com/AryaShah800"
          className="rounded text-sm text-muted transition hover:text-fg"
          rel="noreferrer"
        >
          GitHub
        </a>
      </header>

      <main id="main" className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 pt-16 pb-20">
        <p className="mb-4 font-mono text-xs tracking-[0.2em] text-accent uppercase">Pair programming in the browser</p>
        <h1 className="max-w-3xl text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-6xl">
          One link. One editor.
          <br />
          <span className="text-muted">Everyone coding together.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-pretty text-muted">
          Create a room, send the link, and edit the same file in real time with live cursors, a shared language
          setting and shared run output. No sign-up.
        </p>

        <div className="mt-10 max-w-2xl">
          <HomeActions />
        </div>

        <section aria-labelledby="features-heading" className="mt-20">
          <h2 id="features-heading" className="sr-only">
            Features
          </h2>
          <ul className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="bg-panel p-6">
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="relative border-t border-line">
        <p className="mx-auto max-w-5xl px-6 py-6 text-xs text-muted">
          Built with Next.js, Monaco, Yjs and a separate y-websocket server. Rooms live in the sync server&apos;s memory
          and are cleared after 30 minutes with nobody in them.
        </p>
      </footer>
    </div>
  );
}
