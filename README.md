# Spatial Synth Maestro

The public website, support guide and privacy policy for Spatial Synth Maestro, an instrument for Apple Vision Pro.

The page combines native instrument drawings, a six-chapter sound film, an original procedural pen alphabet, spatial fragments and clearly labeled concept artwork. Sound starts only after the visitor presses Play or deliberately grabs a hand and moves it over a drawing. Hand previews use the native clips at low gain, fade on release, and can be muted with the speaker control. Keyboard users can grab with Space, move with arrows, release with Escape and return the hand with Home. The app is being prepared for release; the floating headset identifies its platform.

This is a static site with no build step, third-party analytics or client-side credentials. GitHub Pages serves the repository root. Media provenance is in [media/README.md](media/README.md).

Public address: https://jamminstein.github.io/spatial-synth-maestro/

The opening uses the three-plane scene with a black draggable hand. The six-voice misprint sits near the end with a white hand; its drawings link quietly to film chapters. There is no duplicate sound-study selector.

The gallery runs weather, night glass, tidal, featuring Almost Asleep, Someone Else and An Old Feeling respectively. Supporting drawings yield their captions to that featured voice. The footer contains only the native
three-layer app icon. Headset rotation uses an unrestricted quaternion trackball.
Decorative pointer responses render on demand and have no idle animation loop.
For silent interaction QA, use `?hand-audio=silent`; this skips AudioContext and
hand-audio fetches entirely. Film playback remains explicit. The film is rendered on the page’s #f8f8f3 paper, with normal blending and no compensating color filter.
