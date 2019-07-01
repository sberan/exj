<pre>
  EXJ(1)
  
  exj
  
  <b>NAME</b>
         exj - node.js standard input processor
  
  <b>SYNOPSIS</b>
         <em>exj</em> [<em>OPTIONS</em>] 'fn'
         <em>exj</em> [<em>OPTIONS</em>] <em>-f</em> | <em>--file</em> 'fnfile'

  <b>DESCRIPTION</b>
         <em>Exj</em> executes the given <em>fn</em> upon the standard input. <em>Fn</em> is expected to
         be a JavaScript function expression. The result of <em>fn</em> execution is 
         printed to standard output.
         
         If the result type of <em>fn</em> is a <b>string</b>, the result is printed directly
         to standard output.
        
         If the result type of <em>fn</em> is <b>null</b> or <b>undefined</b>, no action is taken.

         Any other result type is converted to JSON using <em>JSON.stringify()</em> and
         pretty-printed to standard output.
  
         If the result of <em>fn</em> is a <b>Promise</b>, the promise will be resolved and the
         result printed according to the above rules.

  <b>GLOBALS</b>
         <b>EXEC</b>
                A tagged template string which will execute escape and execute the contents as a child
                process, similar to running with <em>-x</em>

                EXAMPLE - print all files in the current directory:
                
                echo ls | exj -l 'x => EXEC`cat ${x}`'


  <b>OPTIONS</b>
         <b>-j</b>, <b>--json</b>
                Treat the input text as JSON. Input text will be parsed to
                JavaScript objects using <em>JSON.parse()</em> before being passed to <em>fn</em>.

         <b>-l</b>, <b>--line</b>
                Process each line of input separately. For each line of standard
                input, <em>fn</em> will be invoked for each line encountered, and the
                result will be written to standard output.

         <b>-x</b>, <b>--exec</b>
                Execute each output entry as a child process. The standard output
                of the finished process will be written to standard out.

                NOTE: Output entry MUST be an array of the format ['executable', 'arg1', 'arg2', ...]

         <b>-f</b>, <b>--file</b> <em>'fnfile'</em>
                Read <em>fn</em> from a file, whose path is located at <em>'fnfile'</em>.

         <b>-g</b>, <b>--group-lines</b> <em>'num'</em>
                When processing lines, group batches of <em>num</em> lines together as an array

         <b>-c</b>, <b>--concurrency</b> <em>'num'</em>
                When executing results via <em>--exec</em> option, execute at most <em>num</em>
                commands at once.

                Concurrency level also applies to awaiting of Promise results: no more lines
                of input will be processed while <em>'num'</em> results are in flight.

         <b>-r</b>, <b>--require</b> <em>package[:alias]</em>
                An NPM package to be required into the namespace of 'fn', with optional alias

         <b>--help</b>
                Print usage text

  <b>EXAMPLES</b>
  
         ls | exj -l 'x => x.toUpperCase()'
                Print the contents of the current directory in uppercase
  
         curl https://jsonplaceholder.typicode.com/photos \
          | exj -j 'res => res.map((image) => `${image.title} - ${image.thumbnailUrl}`).join("\n")' | pbcopy
                Fetch and process a JSON payload of album artwork to the clipboard
  
         ls *.js | exj -lx 'x => ["mv", x, x.replace(/\.js$/, ".ts")]'
                convert javascript files to typescript

         cat urls.txt -l --concurrency 5 --require 'node-fetch:fetch' 'url => fetch(url).then(r => r.json())'
                Fetch the json contents of a list of URLs, fetching up to five URLs simultaneously

  <b>SEE ALSO</b>
         <b>awk</b>(1), <b>jq</b>(1), <b>xargs</b>(1)
  
</pre>