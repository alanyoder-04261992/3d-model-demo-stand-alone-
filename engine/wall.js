/* WALL COORDINATES -> WORLD COORDINATES. Node-safe.

   Every door, window, board and stud on a wall is placed in the wall's own
   coordinates: u along the wall (to your right when you stand outside facing
   it), y straight up (absolute height, same as the world), and o straight out
   from the face of the siding. A wall definition (from model/frame.js wallDefs)
   is either an axis wall {ax, n, at, cx, len, top} or a free wall at an angle
   {ox, oz, ax, n, len, top} (the corner-porch diagonal).

   Lifted verbatim from Barnwright's 3ddesign.html (wallPt, line 2287). */
export function wallPt(w, u, y, o) {
  if (w.ox !== undefined) return [w.ox + w.ax[0] * u + w.n[0] * o, y, w.oz + w.ax[2] * u + w.n[2] * o];
  var c = w.cx || 0;
  if (w.n[2] !== 0) return [c + w.ax[0] * u, y, w.at + w.n[2] * o];
  return [w.at + w.n[0] * o, y, c + w.ax[2] * u];
}
