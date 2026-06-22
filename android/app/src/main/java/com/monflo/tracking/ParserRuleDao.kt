package com.monflo.tracking

import androidx.room.*

@Dao
interface ParserRuleDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(rules: List<ParserRule>)

    @Query("SELECT * FROM parser_rules ORDER BY version DESC")
    suspend fun getAll(): List<ParserRule>

    @Query("DELETE FROM parser_rules")
    suspend fun deleteAll()
}
