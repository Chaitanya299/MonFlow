package com.monflo.tracking

import androidx.room.*

@Dao
interface ProcessedTransactionDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(tx: ProcessedTransaction)

    @Query("SELECT * FROM processed_transactions WHERE id = :id")
    suspend fun getById(id: String): ProcessedTransaction?

    @Query("SELECT * FROM processed_transactions WHERE timestamp BETWEEN :startMs AND :endMs ORDER BY timestamp DESC")
    suspend fun getByDateRange(startMs: Long, endMs: Long): List<ProcessedTransaction>

    @Query("SELECT * FROM processed_transactions WHERE category = :category ORDER BY timestamp DESC")
    suspend fun getByCategory(category: String): List<ProcessedTransaction>

    @Query("SELECT * FROM processed_transactions WHERE category = 'untagged' ORDER BY timestamp DESC")
    suspend fun getUntagged(): List<ProcessedTransaction>

    @Query("UPDATE processed_transactions SET isSplit = 1, splitGroupId = :splitGroupId WHERE id = :txId")
    suspend fun markAsSplit(txId: String, splitGroupId: String)

    @Query("UPDATE processed_transactions SET category = :category WHERE id = :txId")
    suspend fun updateCategory(txId: String, category: String)

    @Query("DELETE FROM processed_transactions WHERE id = :id")
    suspend fun delete(id: String)
}
