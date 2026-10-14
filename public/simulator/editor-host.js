const send = self.postMessage.bind(self)
let rotated = false

self.sim_display_rotation = value => { rotated = Boolean(value) }
self.postMessage = (message, ...transfer) => {
  if (rotated && message.frame) {
    const pixels = new Uint8Array(message.frame.buffer)
    for (let left = 0, right = pixels.length - 4; left < right; left += 4, right -= 4) {
      for (let channel = 0; channel < 4; channel++) {
        const value = pixels[left + channel]
        pixels[left + channel] = pixels[right + channel]
        pixels[right + channel] = value
      }
    }
  }
  send(message, ...transfer)
}
