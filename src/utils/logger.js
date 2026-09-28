function write(level, message, extra = {}) {
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...extra,
  });
  if (level === "error") console.error(line);
  else console.log(line);
}

export const log = {
  info(message, extra) {
    write("info", message, extra);
  },
  error(message, extra) {
    write("error", message, extra);
  },
};
