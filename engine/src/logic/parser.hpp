#pragma once

namespace pp {

// Parse a full JSON config string and populate g_entityRegistry + g_ruleSet.
// Returns true on success, false if the JSON is malformed or missing.
bool parseConfig(const char* json);

} // namespace pp
