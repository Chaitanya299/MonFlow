package com.monflo.tracking

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query

@Dao
interface RawAlertDao {
    @Query("SELECT * FROM raw_alerts ORDER BY timestamp ASC")
    fun getAll(): List<RawAlert>

    @Insert
    fun insert(alert: RawAlert)

    @Query("DELETE FROM raw_alerts WHERE id IN (:ids)")
    fun deleteByIds(ids: List<Int>)

    @Query("SELECT COUNT(*) FROM raw_alerts WHERE rawText = :text AND timestamp > :sinceMs")
    fun countSimilar(text: String, sinceMs: Long): Int
}