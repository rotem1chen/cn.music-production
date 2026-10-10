// CN PROD — score candidate frames for the grid stills (used by tools/storyboards.mjs).
//   swift tools/frame-score.swift a.jpg b.jpg …   → one JSON line per image
// Uses Apple's Vision (on-device): faces and people, and where they are; plus brightness, contrast and
// detail from a small grayscale copy — so a still is never a black frame, a blank sky or a blur.
import Foundation
import Vision
import CoreGraphics
import ImageIO

func stats(_ img: CGImage) -> (lum: Double, std: Double, detail: Double, sig: [Int]) {
  let w = 96, h = 54
  var px = [UInt8](repeating: 0, count: w * h)
  let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w,
                      space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!
  ctx.interpolationQuality = .medium
  ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
  let v = px.map { Double($0) / 255 }
  let mean = v.reduce(0, +) / Double(v.count)
  let std = sqrt(v.map { ($0 - mean) * ($0 - mean) }.reduce(0, +) / Double(v.count))
  var g = 0.0
  for y in 0..<(h - 1) { for x in 0..<(w - 1) {
    let i = y * w + x
    g += abs(v[i + 1] - v[i]) + abs(v[i + w] - v[i])
  } }
  // a 16x9 fingerprint (0–99): two frames of the same shot look alike here, so they aren't both picked
  var sig = [Int]()
  for by in 0..<9 { for bx in 0..<16 {
    var t = 0.0
    for y in (by * 6)..<(by * 6 + 6) { for x in (bx * 6)..<(bx * 6 + 6) { t += v[y * w + x] } }
    sig.append(Int(t / 36 * 99))
  } }
  return (mean, std, g / Double((w - 1) * (h - 1)), sig)
}

for path in CommandLine.arguments.dropFirst() {
  guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
        let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { continue }
  let faces = VNDetectFaceRectanglesRequest()
  let people = VNDetectHumanRectanglesRequest()
  people.upperBodyOnly = false
  try? VNImageRequestHandler(cgImage: img, options: [:]).perform([faces, people])
  let fr = (faces.results ?? []).map { $0.boundingBox }
  let pr = (people.results ?? []).filter { $0.confidence > 0.5 }.map { $0.boundingBox }
  // the subject: the biggest face, else the biggest person (Vision's y runs bottom-up)
  let best = (fr.max { $0.width * $0.height < $1.width * $1.height }) ?? (pr.max { $0.width * $0.height < $1.width * $1.height })
  let s = stats(img)
  var o: [String: Any] = ["path": path, "lum": s.lum, "std": s.std, "detail": s.detail,
    "sig": s.sig, "faces": fr.count, "faceArea": fr.map { $0.width * $0.height }.max() ?? 0,
    "people": pr.count, "personArea": pr.map { $0.width * $0.height }.max() ?? 0]
  if let b = best { o["fx"] = b.midX; o["fy"] = 1 - b.midY }
  let d = try! JSONSerialization.data(withJSONObject: o)
  print(String(data: d, encoding: .utf8)!)
}
