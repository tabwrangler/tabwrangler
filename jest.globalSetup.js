// Test files get a copy of `process.env`, so setting `TZ` in one does not change the time zone.
// Tests use US Eastern time for its DST changes.
module.exports = () => {
  process.env.TZ = "America/New_York";
};
