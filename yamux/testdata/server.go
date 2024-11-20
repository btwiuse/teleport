package main

import (
	"log"
	"net/http"
	"time"

	"github.com/btwiuse/wsconn"
	"github.com/hashicorp/yamux"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		conn, err := wsconn.Wrconn(w, r)
		if err != nil {
			log.Println(err)
			return
		}
		config := yamux.DefaultConfig()
		config.EnableKeepAlive = false
		config.KeepAliveInterval = 5 * time.Second
		ssn, err := yamux.Server(conn, config)
		if err != nil {
			log.Println(err)
			return
		}
		defer ssn.Close()
		for {
			stream, err := ssn.Accept()
			if err != nil {
				log.Println(err)
				return
			}
			go func() {
				defer stream.Close()
				buf := make([]byte, 1024)
				for {
					n, err := stream.Read(buf)
					if err != nil {
						log.Println(err)
						return
					}
					_, err = stream.Write(buf[:n])
					if err != nil {
						log.Println(err)
						return
					}
				}
			}()
		}
	})

	err := http.ListenAndServe(":8088", nil)
	if err != nil {
		log.Fatal(err)
	}
}
