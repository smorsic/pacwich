/**
 * A small, self-contained `os` for the browser, aliased in `rspress.config.ts`
 * for `os`/`node:os`. The stock `os` polyfill omits `constants.signals`, which
 * pacwich reads at module load (`subprocesses.ts`). Implementing the surface
 * directly (rather than wrapping the polyfill) avoids a self-referential alias
 * cycle and lets us guarantee the fields pacwich touches exist.
 */

export const EOL = "\n";

export const tmpdir = () => "/tmp";
export const homedir = () => "/home/user";
export const hostname = () => "browser";
export const platform = () => "linux";
export const type = () => "Linux";
export const arch = () => "x64";
export const release = () => "0.0.0";
export const version = () => "web-cli demo";
export const machine = () => "x86_64";
export const endianness = () => "LE";
export const uptime = () => 0;
export const loadavg = () => [0, 0, 0];
export const totalmem = () => 0;
export const freemem = () => 0;
export const availableParallelism = () => 4;
export const networkInterfaces = () => ({});
export const userInfo = () => ({
  username: "user",
  uid: 1000,
  gid: 1000,
  shell: "/bin/sh",
  homedir: "/home/user",
});

export const cpus = () =>
  Array.from({ length: 4 }, () => ({
    model: "browser",
    speed: 0,
    times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 },
  }));

// Standard Linux signal numbers — enough for pacwich's top-level
// `os.constants.signals` read; signal delivery itself never runs here.
export const constants = {
  signals: {
    SIGHUP: 1,
    SIGINT: 2,
    SIGQUIT: 3,
    SIGILL: 4,
    SIGTRAP: 5,
    SIGABRT: 6,
    SIGBUS: 7,
    SIGFPE: 8,
    SIGKILL: 9,
    SIGUSR1: 10,
    SIGSEGV: 11,
    SIGUSR2: 12,
    SIGPIPE: 13,
    SIGALRM: 14,
    SIGTERM: 15,
    SIGCHLD: 17,
    SIGCONT: 18,
    SIGSTOP: 19,
    SIGTSTP: 20,
    SIGTTIN: 21,
    SIGTTOU: 22,
  },
};

export default {
  EOL,
  tmpdir,
  homedir,
  hostname,
  platform,
  type,
  arch,
  release,
  version,
  machine,
  endianness,
  uptime,
  loadavg,
  totalmem,
  freemem,
  availableParallelism,
  networkInterfaces,
  userInfo,
  cpus,
  constants,
};
