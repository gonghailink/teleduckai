import {
  type DatabaseDriver,
  drivers,
  DriverType,
  useDatabase,
} from '@/composables/database.ts'
import 'jsr:@std/dotenv/load'

let db: DatabaseDriver | undefined
let kv: Deno.Kv | undefined

export async function useKv() {
  if (!kv) {
    kv = await Deno.openKv(
      Deno.env.get('DB_DRIVER') === 'kv' ? Deno.env.get('DB_URL') : undefined,
    )
  }
  return kv
}

export async function useDB() {
  if (!db) {
    const driver: DriverType = Deno.env.get('DB_DRIVER') as DriverType ??
      'kv'

    if (!drivers.includes(driver)) throw new Error(`Invalid driver: ${driver}`)

    db = await useDatabase(driver, {
      url: Deno.env.get('DB_URL'),
      authToken: Deno.env.get('DB_AUTH_TOKEN'),
    })
  }
  return db
}
