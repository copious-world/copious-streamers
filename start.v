import json
import os


struct User {
	name string
	age  int
mut:
	is_registered bool
}

fn (u User) can_register() bool {
	return u.age >= 16
}

fn (mut u User) register() {
	u.is_registered = true
}


fn user_from_json(u_son string) ?User {
     user:= json.decode(User, u_son) or {
        return error('User >> failed conversion:: $u_son')
    }
    return user
}


// 
//
fn test_stuff() {
    //
    mut a, mut b := foo()
    println(a)
    println(b)

    a = b + 2*a
    b++

    println("$a and $b")
    //
    x := 123.4567
    println('x = ${x:4.2f}')
    println('[${x:10}]') // pad with spaces on the left => [   123.457]
    println('[${int(x):-10}]') // pad with spaces on the right => [123       ]
    println('[${int(x):010}]') // pad with zeros on the left => [0000000123]
}

fn main() {

    println(os.args)
    test_stuff()
    //
	s := '[{ "name":"Frodo", "age":25}, {"name":"Bobby", "age":10}]'
	mut users := json.decode([]User, s) or {
		eprintln('Failed to parse json')
		return
	}
    //
    u3 := '{"name":"Janie", "age":40}'
    mut another_u := user_from_json(u3) or {
         eprintln('Could not convert user')
         return
    }
    //
    users << another_u


	for user in users {
		println('$user.name: $user.age')
	}
	println('')
	for i, user in users {
		println('$i) $user.name')
		if !user.can_register() {
			println('Cannot register $user.name, they are too young')
		} else {
			users[i].register()
			println('$user.name is registered')
		}
	}
	// Let's encode users again just for fun
	println('')
	println(json.encode(users))
}



fn foo() (int, int) {
	return 2, 3
}
