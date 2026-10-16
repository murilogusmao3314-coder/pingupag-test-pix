<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application rules
- Reconstruct reference content through owned React modules under src/components/monster; never execute uploaded bundles or import their tracking/backend code. This keeps the current router and payment security boundaries intact.
- Keep pricing calculations in integer cents in checkout-schema.ts; createPix remains the server-only provider boundary. This prevents rounding errors and credential exposure.
- Ship all page images as original binary files in public/images and reference /images/ paths; retain managed pointers only as recovery provenance. This makes image delivery independent of Lovable on Netlify; content.json remains the source reference copy.
