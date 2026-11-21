# About these sound studies

The drawings and sound come from Spatial Synth Maestro's actual instrument engines.
Each eight-second portrait pairs one of the club's six instruments with its own synthesis.
The 64-second film opens with 16 seconds from the real six-voice AudioGraph, then presents
rhythm (Private Ritual), bass (Below Thought), harmony (What We Keep), sequence
(Restless Tongue), melody (Small Doubts), and texture (Open Window) individually.
All seven passages use the same 120 BPM piece, seed `47e9fc3fa2ee17d3`.

These are offline studio renders, not headset footage, app screenshots or an HRTF/spatial
audio demonstration. No microphone input, user recordings or stock sound is used. Constant
level matching and gentle fades prepare the original synthesis for listening on the web.

The warm-paper images preserve the native pixels at integer scale. Transparent native
128×128 ink images are supplied alongside them. English sound-description captions are
available in `module-film.vtt`.

The film and poster are rendered on the website's `#f8f8f3` paper in sRGB.
The MP4 identifies its BT.709 matrix/primaries, sRGB transfer and limited range;
the poster identifies sRGB. The website displays them with normal blending and
no color filter. Video/JPEG quantization can differ from the paper by one 8-bit
color-channel step.

The handwritten titles and short poems are drawn from an original coordinate alphabet,
with seeded pressure, uneven spacing and displaced strokes. These same pen paths draw
the website lettering; they are not a handwriting font or generated replacement artwork.

<!-- concept-art-provenance -->

The separate `concept-studio.png` image is AI-generated editorial concept artwork. It depicts an imagined environment, not an app screenshot or actual headset footage.

The gallery images `concept-tidal.webp`, `concept-weather.webp` and `concept-night.webp`
were generated with OpenAI `gpt-image-2` through the API on November 2, 2026, at
2048 × 1152 with high quality. They are imagined environments with floating ink forms,
not app screenshots, recorded headset footage or demonstrations of the app's rendering.
The current gallery order is weather, night glass, tidal. The earlier studio
concept is retained as a source asset but is no longer shown in the gallery.

<!-- headset-lighting-provenance -->

The rotating headset uses the credited community model described in
`vision-pro-LICENSE.txt`. `headset-room.pmrem.gz` stores its existing Three.js
RoomEnvironment lighting as losslessly packed linear half-float cube faces and
roughness levels. The loader restores the original HDR values and full mip chain;
this is generated lighting data, not a photograph or a replacement headset image.
The same room generator remains available when the packed data cannot be used.

The footer uses 512-pixel exports of the actual visionOS AppIcon back, middle and
front layers. They preserve the native artwork and transparency; CSS places the
three layers at different depths and responds only to pointer movement.

The six-voice opening gives every instrument a separate, full-contrast procedural handwritten name. Three embedded bitmap name strips are omitted only in that promotional grid to avoid duplicate labels. Native module assets and the complete audio stream are unchanged.
