package com.monflo.tracking

import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import android.content.Context
import net.zetetic.database.sqlcipher.SupportOpenHelperFactory

@Database(entities = [RawAlert::class], version = 1)
abstract class NativeDatabase : RoomDatabase() {
    abstract fun rawAlertDao(): RawAlertDao

    companion object {
        private var INSTANCE: NativeDatabase? = null

        fun getInstance(context: Context, passphrase: ByteArray): NativeDatabase {
            return INSTANCE ?: synchronized(this) {
                val factory = SupportOpenHelperFactory(passphrase)
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