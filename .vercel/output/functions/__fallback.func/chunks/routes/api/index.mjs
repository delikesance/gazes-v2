import { d as defineEventHandler } from '../../nitro/nitro.mjs';
import 'jsonwebtoken';
import 'bcryptjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import '@supabase/supabase-js';
import '@iconify/utils';
import 'consola';
import 'node:url';
import 'ipx';

const index = defineEventHandler(async (event) => {
  return { message: "Test route works", params: event.context.params };
});

export { index as default };
//# sourceMappingURL=index.mjs.map
