---
name: no-use-effect
description: |
  Enforce the no-useEffect rule when writing or reviewing React code.
  ACTIVATE when writing React components, refactoring existing useEffect calls,
  reviewing PRs with useEffect, or when an agent adds useEffect "just in case."
  Provides the five replacement patterns and the useMountEffect escape hatch.
---

# No useEffect

Never call `useEffect` directly. Use derived state, event handlers, data-fetching libraries, or `useMountEffect` instead.

## Quick Reference

- Lint rule: `no-restricted-syntax` (configured to ban `useEffect`)
- React docs: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

| Instead of useEffect for...           | Use                                         |
| ------------------------------------- | ------------------------------------------- |
| Deriving state from other state/props | Inline computation (Rule 1)                 |
| Fetching data                         | `useQuery` / data-fetching library (Rule 2) |
| Responding to user actions            | Event handlers (Rule 3)                     |
| One-time external sync on mount       | `useMountEffect` (Rule 4)                   |
| Resetting state when a prop changes   | `key` prop on parent (Rule 5)               |

## When to Use This Skill

- Writing new React components
- Refactoring existing `useEffect` calls
- Reviewing PRs that introduce `useEffect`
- An agent adds `useEffect` "just in case"

## Workflow

### 1. Identify the useEffect

Determine what the effect is doing -- deriving state, fetching data, responding to an event, syncing with an external system, or resetting state.

### 2. Apply the Correct Replacement Pattern

Use the five rules below to pick the right replacement.

### 3. Verify

```bash
npm run lint -- --filter=<package>
npm run typecheck -- --filter=<package>
npm run test -- --filter=<package>
```

## The Escape Hatch: useMountEffect

For the rare case where you need to sync with an external system on mount:

The implementation wraps `useEffect` with an empty dependency array to make intent explicit:

```typescript
export function useMountEffect(effect: () => void | (() => void)) {
  /* eslint-disable no-restricted-syntax */
  useEffect(effect, []);
}
```

## Replacement Patterns

### Rule 1: Derive state, do not sync it

Most effects that set state from other state are unnecessary and add extra renders.

```typescript
// BAD: Two render cycles - first stale, then filtered
function ProductList() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);

  useEffect(() => {
    setFilteredProducts(products.filter((p) => p.inStock));
  }, [products]);
}

// GOOD: Compute inline in one render
function ProductList() {
  const [products, setProducts] = useState([]);
  const filteredProducts = products.filter((p) => p.inStock);
}
```

**Smell test:** You are about to write `useEffect(() => setX(deriveFromY(y)), [y])`, or you have state that only mirrors other state or props.

### Rule 2: Use data-fetching libraries

Effect-based fetching creates race conditions and duplicated caching logic.

```typescript
// BAD: Race condition risk
function ProductPage({ productId }) {
  const [product, setProduct] = useState(null);

  useEffect(() => {
    fetchProduct(productId).then(setProduct);
  }, [productId]);
}

// GOOD: Query library handles cancellation/caching/staleness
function ProductPage({ productId }) {
  const { data: product } = useQuery(["product", productId], () => fetchProduct(productId));
}
```

**Smell test:** You have `useEffect` with `fetch`, `axios`, or any async call inside, and you are manually managing loading/error/data state.

### Rule 3: Event handlers, not effects

If something happens in response to a user action, put it in the event handler.

```typescript
// BAD: Effect responding to state change triggered by click
function LikeButton() {
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (liked) postLike();
  }, [liked]);

  return <button onClick={() => setLiked(true)}>Like</button>;
}

// GOOD: Direct event-driven action
function LikeButton() {
  return <button onClick={() => postLike()}>Like</button>;
}
```

**Smell test:** Your effect runs because a state variable changed, but that state variable was set by an event handler you control. Move the logic into the handler.

### Rule 4: useMountEffect for one-time external sync

Use `useMountEffect` for stable dependencies (singletons, refs, context values that never change):

```typescript
// BAD: Guard inside effect
function VideoPlayer({ isLoading }) {
  useEffect(() => {
    if (!isLoading) playVideo();
  }, [isLoading]);
}

// BAD: useEffect with dependency that never changes
useEffect(() => {
  connectionManager.on('connected', handleConnect);
  return () => connectionManager.off('connected', handleConnect);
}, [connectionManager]); // connectionManager is a singleton from context

// GOOD: useMountEffect for stable dependencies
useMountEffect(() => {
  connectionManager.on('connected', handleConnect);
  return () => connectionManager.off('connected', handleConnect);
});

// GOOD: key forces clean remount
function VideoPlayer({ videoId }) {
  useMountEffect(() => {
    loadVideo(videoId);
  });
}

function VideoPlayerWrapper({ videoId }) {
  return <VideoPlayer key={videoId} videoId={videoId} />;
}
```

**Smell test:** Your effect's dependencies are stable (never change) or you are guarding with conditionals inside the effect. Use `useMountEffect` or restructure with `key`.

### Rule 5: Reset with key, not dependency choreography

When a prop changes and you need to reset component state, use `key` on the parent instead of an effect that watches the prop.

```typescript
// BAD: Manual reset via effect
function UserProfile({ userId }) {
  const [formState, setFormState] = useState(initialState);

  useEffect(() => {
    setFormState(initialState);
  }, [userId]);
}

// GOOD: key forces full remount with fresh state
function UserProfilePage({ userId }) {
  return <UserProfile key={userId} userId={userId} />;
}
```

**Smell test:** You have `useEffect(() => resetSomething(), [someProp])`. Use `key={someProp}` on the component instead.

## Component Template

```typescript
function ComponentName({ prop1, prop2 }: Props) {
  // Local state
  const [isOpen, setIsOpen] = useState(false);

  // Computed values (NOT useEffect + setState)
  const displayName = user?.name ?? 'Unknown';

  // Data fetching (NOT useEffect + fetch)
  const { data } = useQuery(['key'], fetchFn);

  // Event handlers
  const handleClick = () => { setIsOpen(true); };

  // One-time setup (NOT useEffect with [])
  useMountEffect(() => {
    thirdPartyLib.init();
    return () => thirdPartyLib.destroy();
  });

  return <div onClick={handleClick}>{displayName}</div>;
}
```
