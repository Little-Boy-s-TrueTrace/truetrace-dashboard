package consumer

import (
	"context"
	"log"
)

// StartKafkaConsumer launches a goroutine that reads from the
// Kafka topic. Dummy implementation for now.
func StartKafkaConsumer(ctx context.Context) {
	log.Println("[Kafka Consumer] Dummy consumer started.")
}
