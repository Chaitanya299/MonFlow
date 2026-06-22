package com.monflo.tracking

import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import android.content.Context
import net.sqlcipher.database.SupportFactory

@Database(entities = [RawAlert::class, ProcessedTransaction::class, ParserRule::class], version = 3)
@TypeConverters(Converters::class)
abstract class NativeDatabase : RoomDatabase() {
    abstract fun rawAlertDao(): RawAlertDao
    abstract fun processedTransactionDao(): ProcessedTransactionDao
    abstract fun parserRuleDao(): ParserRuleDao

    companion object {
        private var INSTANCE: NativeDatabase? = null

        fun getInstance(context: Context): NativeDatabase {
            return INSTANCE ?: synchronized(this) {
                val vaultManager = VaultManager(context)
                val passphrase = vaultManager.getDatabasePassphrase()
                val factory = SupportFactory(passphrase)
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    NativeDatabase::class.java, "monflo-native-vault"
                ).openHelperFactory(factory).build()
                INSTANCE = instance
                instance
            }
        }
    }
}