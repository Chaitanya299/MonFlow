package com.monflo.tracking

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "parser_rules")
data class ParserRule(
    @PrimaryKey val id: String,
    val pattern: String,
    val flags: String,
    val version: Int
)
