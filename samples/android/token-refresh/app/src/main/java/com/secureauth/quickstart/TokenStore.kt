package com.secureauth.quickstart

/** Minimal contract for persisting and retrieving the refresh token. */
interface TokenStore {
    fun save(token: String)
    fun load(): String?
    fun clear()
}
