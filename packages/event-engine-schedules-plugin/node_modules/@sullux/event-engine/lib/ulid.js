const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const ENCODING_LEN = 32
const TIME_LEN = 10
const RANDOM_LEN = 16

const ulidFactory = (nowFn = Date.now, randomFn = Math.random) => {
  let lastTime = -1
  let lastRandomBytes = new Array(RANDOM_LEN).fill(0)

  const encodeTime = (time) => {
    let str = ''
    for (let i = TIME_LEN - 1; i >= 0; i--) {
      str = ENCODING[time % ENCODING_LEN] + str
      time = Math.floor(time / ENCODING_LEN)
    }
    return str
  }

  const encodeRandomBytes = (bytes) => {
    let str = ''
    for (let i = 0; i < bytes.length; i++) {
      str += ENCODING[bytes[i] % ENCODING_LEN]
    }
    return str
  }

  return () => {
    let now = nowFn()
    if (now < lastTime) {
      now = lastTime // Prevent backwards time drift
    }

    if (now === lastTime) {
      // Increment last random bytes for strict monotonicity within same millisecond
      let i = RANDOM_LEN - 1
      while (i >= 0) {
        lastRandomBytes[i] = (lastRandomBytes[i] + 1) % ENCODING_LEN
        if (lastRandomBytes[i] !== 0) break
        i--
      }
    } else {
      lastTime = now
      for (let i = 0; i < RANDOM_LEN; i++) {
        lastRandomBytes[i] = Math.floor(randomFn() * ENCODING_LEN)
      }
    }

    return encodeTime(now) + encodeRandomBytes(lastRandomBytes)
  }
}

module.exports = { ulidFactory }
