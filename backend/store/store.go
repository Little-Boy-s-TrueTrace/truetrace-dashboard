package store

// InitStore initializes only dashboard authentication storage. Compliance
// business data is owned by the Spring backend and is never mirrored here.
func InitStore() {
	InitDB()
}
