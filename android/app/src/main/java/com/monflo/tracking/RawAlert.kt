package com.monflo.tracking

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "raw_alerts")
data class RawAlert(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val rawText: String,
    val packageName: String,
    val timestamp: Long
)