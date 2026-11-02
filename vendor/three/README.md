# Three.js 0.187.0

Vendored from the official `three@0.187.0` npm package, MIT license.
Source: https://www.npmjs.com/package/three/v/0.187.0
Repository: https://github.com/mrdoob/three

Package integrity: sha512-Qiu7R+Cmh8CstZsY1uJOSWnVlfo7ZtNLV7mF8Jltk3LB3AtDu9cRZlcnRKkAk8Y4z6KKw35z7Y7Urd7jWY8etA==

WebGL/core builds are unchanged. GLTFLoader, BufferGeometryUtils, SkeletonUtils
and RoomEnvironment use local relative import paths; their logic is unchanged.
The headset widget loads only same-site modules and its embedded-texture GLB.
No external decoder, runtime CDN, audio library or animation loop is started.
