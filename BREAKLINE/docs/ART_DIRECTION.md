# BREAKLINE — Art Direction

**Target:** premium stylized sci-fi. Not photorealistic, never "cheap mobile
game." Clean, modern, technological, cinematic, glowing.

## Visual language

- Glass, metal, energy, neon, light, particles, glow.
- Cool blue/violet palette for Glass District, high contrast against a dark
  near-black sky so emissive surfaces read clearly on small phone screens.
- Everything glass-like is translucent + emissive (`StandardMaterial3D` with
  `transparency = ALPHA`, `emission_enabled = true`) so it pops without
  needing baked lighting or custom shaders yet.

## Current implementation (vertical slice)

Fully procedural / primitive-based — no imported models, textures, or
custom shaders:

- `EnvironmentBuilder.gd` generates the ground strip and two rows of
  translucent emissive "skyscraper" slabs from `BoxMesh` + `PlaneMesh`.
- Targets, obstacles, projectiles, fragments are `BoxMesh`/`SphereMesh`
  primitives with emissive materials — see `assets/materials` conventions
  below once real materials replace these.
- Fog + a dark `ProceduralSkyMaterial` + light `glow` on the `WorldEnvironment`
  give depth and neon bloom cheaply.

This is intentional placeholder-with-a-plan: the moment real models/
materials exist, they drop into `assets/models` and `assets/materials` and
replace the procedural mesh generation call-by-call — no gameplay code
changes, since gameplay only ever touches `MeshInstance3D`/collision
shapes, never raw geometry.

## What NOT to copy

No model, texture, sound, animation, UI layout, or level design from any
existing "endless runner + shoot glass" game. Continuous-forward-motion +
projectile + destruction is a genre convention, not something we're
copying from a specific title — BREAKLINE's identity is its own palette,
world names, target/obstacle mechanics, and UI.
