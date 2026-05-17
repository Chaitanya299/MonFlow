package com.monflo.tracking

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "processed_transactions")
data class ProcessedTransaction(
    @PrimaryKey val id: String,
    val amountPaise: Long,
    val currency: String,
    val merchantName: String?,
    val category: String,
    val tags: List<String>,
    val sourcePackage: String,
    val rawText: String,
    val timestamp: Long,
    val isSplit: Boolean,
    val splitGroupId: String?,
    val trustLevel: String
)
