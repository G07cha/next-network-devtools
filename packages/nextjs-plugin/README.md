# Next Network extension plugin

A required component to be able to use [Next Network Devtools browser extension](todo link).

## Installation

```bash
npm install next-network
# or
yarn add next-network
# or
pnpm add next-network
```

## Usage

In your `next.config.js` file, add the plugin:

```js
import { withNextNetwork } from 'next-network';

const nextConfig = withNextNetwork({
 // your existing next.js config
});

export default nextConfig;
```

Create `instrumentation.js` file in the root of your project (if it's not there already) and add the following code:

```js
export async function register() {
  if (
   process.env.NEXT_RUNTIME === "nodejs" &&
   process.env.NODE_ENV === "development"
  ) {
   await import("next-network").then(({ register }) => {
    register();
   });
  }
}
```
