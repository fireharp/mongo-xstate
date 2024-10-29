
```
curl -X POST http://localhost:4242/users
{"message":"New user created successfully","actorId":"tmh2gx"}%  
```

```
curl -X POST http://localhost:4242/users/tmh2gx \
  -H "Content-Type: application/json" \
  -d '{"type": "next"}'

Event received. Check user state.
```

```
curl -X GET http://localhost:4242/users/tmh2gx
```
