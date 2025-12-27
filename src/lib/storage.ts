import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ConversionRecord {
  id: string;
  fileName: string;
  fileType: string;
  outputType: 'docx' | 'xlsx';
  timestamp: number;
  outputBlob: Blob;
  originalSize: number;
  outputSize: number;
}

interface DocConverterDB extends DBSchema {
  conversions: {
    key: string;
    value: ConversionRecord;
    indexes: { 'by-timestamp': number };
  };
  settings: {
    key: string;
    value: string;
  };
}

let db: IDBPDatabase<DocConverterDB> | null = null;

export const initDB = async () => {
  if (db) return db;
  
  db = await openDB<DocConverterDB>('doc-converter-db', 1, {
    upgrade(database) {
      const conversionStore = database.createObjectStore('conversions', {
        keyPath: 'id',
      });
      conversionStore.createIndex('by-timestamp', 'timestamp');
      
      database.createObjectStore('settings', {
        keyPath: undefined,
      });
    },
  });
  
  return db;
};

export const saveConversion = async (record: ConversionRecord) => {
  const database = await initDB();
  await database.put('conversions', record);
};

export const getConversions = async (): Promise<ConversionRecord[]> => {
  const database = await initDB();
  const conversions = await database.getAllFromIndex('conversions', 'by-timestamp');
  return conversions.reverse();
};

export const getConversion = async (id: string): Promise<ConversionRecord | undefined> => {
  const database = await initDB();
  return database.get('conversions', id);
};

export const deleteConversion = async (id: string) => {
  const database = await initDB();
  await database.delete('conversions', id);
};

export const clearConversions = async () => {
  const database = await initDB();
  await database.clear('conversions');
};

export const saveSetting = async (key: string, value: string) => {
  const database = await initDB();
  await database.put('settings', value, key);
};

export const getSetting = async (key: string): Promise<string | undefined> => {
  const database = await initDB();
  return database.get('settings', key);
};
