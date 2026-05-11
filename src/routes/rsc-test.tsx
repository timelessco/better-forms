import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { CompositeComponent, createCompositeComponent } from "@tanstack/react-start/rsc";
import { useState } from "react";

const getRscShell = createServerFn({ method: "GET" }).handler(async () => {
  const serverTimestamp = Date.now();
  const serverIsoTimestamp = new Date(serverTimestamp).toISOString();
  const src = await createCompositeComponent(
    ({ Counter }: { Counter: React.ComponentType<{ label: string }> }) => (
      <section
        style={{
          border: "2px dashed #16a34a",
          padding: 16,
          margin: 16,
          borderRadius: 8,
          fontFamily: "ui-sans-serif, system-ui",
        }}
      >
        <h1 style={{ margin: 0 }}>RSC plumbing test</h1>
        <p>
          This heading and paragraph were rendered on the <strong>server</strong> at{" "}
          <code>{serverIsoTimestamp}</code>.
        </p>
        <p>
          Below this line is a <em>client</em> slot passed as a component prop. If it ticks, slots
          work. If the border is green, streaming works.
        </p>
        <Counter label="Server-provided label" />
      </section>
    ),
  );
  return { src };
});

const RouteComponent = () => {
  const { src } = Route.useLoaderData();
  return <CompositeComponent src={src} Counter={ClientCounter} />;
};

const ClientCounter = ({ label }: { label: string }) => {
  const [count, setCount] = useState(0);
  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        border: "1px solid #2563eb",
        borderRadius: 6,
      }}
    >
      <strong>Client slot:</strong> {label}
      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => setCount((c) => c + 1)}
          style={{ padding: "4px 10px" }}
          type="button"
        >
          clicks: {count}
        </button>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/rsc-test")({
  loader: () => getRscShell(),
  component: RouteComponent,
});
